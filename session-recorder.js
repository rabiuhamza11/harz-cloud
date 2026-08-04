/**
 * HARZ Cloud — Session Recording
 * 
 * Records user sessions across all HARZ platforms:
 * - Full user journey tracking
 * - Click, scroll, input, navigation events
 * - Time spent per page
 * - Rage clicks & dead clicks
 * - Error tracking
 * - Session replay data (for frontend reconstruction)
 * - Heatmap data aggregation
 * - Device & viewport info
 */

const crypto = require('crypto');

/**
 * Start a new session
 */
async function startSession(params, Database) {
  const {
    user_email,
    user_id,
    platform,
    device_type,
    browser,
    os,
    screen_resolution,
    viewport_size,
    language,
    country,
    referrer,
    entry_url,
    session_metadata = {}
  } = params;
  
  const sessionId = crypto.randomUUID();
  
  const session = {
    id: sessionId,
    user_email: user_email || 'anonymous',
    user_id: user_id || null,
    platform: platform || 'unknown',
    device_type: device_type || 'unknown',
    browser: browser || 'unknown',
    os: os || 'unknown',
    screen_resolution: screen_resolution || 'unknown',
    viewport_size: viewport_size || 'unknown',
    language: language || 'en',
    country: country || 'unknown',
    referrer: referrer || 'direct',
    entry_url: entry_url || '',
    exit_url: null,
    page_count: 0,
    event_count: 0,
    duration_seconds: 0,
    is_active: true,
    is_bounce: true,
    has_error: false,
    has_rage_click: false,
    has_dead_click: false,
    conversion: false,
    metadata: JSON.stringify(session_metadata),
    started_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    ended_at: null,
    created_date: new Date().toISOString()
  };
  
  await Database.insert('session_recordings', session);
  
  return { session_id: sessionId, started: true };
}

/**
 * Record a session event (click, scroll, navigation, input, error)
 */
async function recordSessionEvent(sessionId, eventData, Database) {
  const {
    event_type, // navigation, click, scroll, input, error, custom
    element_id,
    element_class,
    element_tag,
    element_text,
    page_url,
    page_title,
    scroll_position,
    input_value_hash, // Hash, never store raw input
    error_message,
    error_stack,
    duration_ms,
    coordinates,
    metadata = {}
  } = eventData;
  
  // Get session
  const session = await Database.findOne('session_recordings', { id: sessionId });
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  // Update session activity
  const now = new Date().toISOString();
  const duration = Math.round((new Date(now) - new Date(session.started_at)) / 1000);
  
  const updates = {
    last_activity: now,
    duration_seconds: duration,
    event_count: (session.event_count || 0) + 1,
    is_bounce: false
  };
  
  if (event_type === 'navigation') {
    updates.page_count = (session.page_count || 0) + 1;
    updates.exit_url = page_url;
  }
  
  if (event_type === 'error') {
    updates.has_error = true;
  }
  
  // Detect rage click (same element clicked 3+ times in 5 seconds)
  if (event_type === 'click' && element_id) {
    const recentClicks = await Database.find('session_events', {
      session_id: sessionId,
      event_type: 'click'
    }, { limit: 10, sort: '-created_date' });
    
    const recentSameElement = recentClicks.filter(c => 
      c.element_id === element_id && 
      new Date(c.created_date) > new Date(Date.now() - 5000)
    );
    
    if (recentSameElement.length >= 2) {
      updates.has_rage_click = true;
    }
  }
  
  // Detect dead click (click with no element / no action)
  if (event_type === 'click' && !element_id && !element_class) {
    updates.has_dead_click = true;
  }
  
  if (event_type === 'conversion' || metadata.conversion) {
    updates.conversion = true;
  }
  
  await Database.update('session_recordings', sessionId, updates);
  
  // Store the event
  const event = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    user_email: session.user_email,
    platform: session.platform,
    event_type,
    element_id: element_id || null,
    element_class: element_class || null,
    element_tag: element_tag || null,
    element_text: (element_text || '').substring(0, 200),
    page_url: page_url || '',
    page_title: page_title || '',
    scroll_position: scroll_position || 0,
    input_value_hash: input_value_hash || null,
    error_message: error_message || null,
    error_stack: error_stack ? error_stack.substring(0, 500) : null,
    duration_ms: duration_ms || null,
    coordinates: coordinates ? JSON.stringify(coordinates) : null,
    metadata: JSON.stringify(metadata),
    timestamp: now,
    created_date: now
  };
  
  await Database.insert('session_events', event);
  
  return { success: true, event_id: event.id, session_event_count: updates.event_count };
}

/**
 * End a session
 */
async function endSession(sessionId, Database) {
  const session = await Database.findOne('session_recordings', { id: sessionId });
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  const now = new Date().toISOString();
  const duration = Math.round((new Date(now) - new Date(session.started_at)) / 1000);
  
  await Database.update('session_recordings', sessionId, {
    is_active: false,
    ended_at: now,
    duration_seconds: duration
  });
  
  return {
    success: true,
    session_id: sessionId,
    duration_seconds: duration,
    page_count: session.page_count,
    event_count: session.event_count,
    is_bounce: session.is_bounce,
    has_error: session.has_error,
    conversion: session.conversion
  };
}

/**
 * Get session replay data
 */
async function getSessionReplay(sessionId, Database) {
  const session = await Database.findOne('session_recordings', { id: sessionId });
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  const events = await Database.find('session_events', { session_id: sessionId }, {
    limit: 1000, sort: 'created_date'
  });
  
  return {
    session: {
      id: session.id,
      user_email: session.user_email === 'anonymous' ? 'anonymous' : '***',
      platform: session.platform,
      device: session.device_type,
      browser: session.browser,
      screen: session.screen_resolution,
      viewport: session.viewport_size,
      started_at: session.started_at,
      ended_at: session.ended_at,
      duration_seconds: session.duration_seconds,
      page_count: session.page_count,
      event_count: session.event_count,
      is_bounce: session.is_bounce,
      has_error: session.has_error,
      has_rage_click: session.has_rage_click,
      has_dead_click: session.has_dead_click,
      conversion: session.conversion,
      entry_url: session.entry_url,
      exit_url: session.exit_url,
      referrer: session.referrer
    },
    events: events.map(e => ({
      timestamp: e.timestamp,
      type: e.event_type,
      element_id: e.element_id,
      element_tag: e.element_tag,
      element_text: e.element_text,
      page_url: e.page_url,
      scroll: e.scroll_position,
      error: e.error_message,
      coordinates: e.coordinates ? JSON.parse(e.coordinates) : null,
      metadata: e.metadata ? JSON.parse(e.metadata) : {}
    })),
    summary: {
      total_pages: session.page_count,
      total_events: events.length,
      clicks: events.filter(e => e.event_type === 'click').length,
      navigations: events.filter(e => e.event_type === 'navigation').length,
      errors: events.filter(e => e.event_type === 'error').length,
      scrolls: events.filter(e => e.event_type === 'scroll').length,
      inputs: events.filter(e => e.event_type === 'input').length
    }
  };
}

/**
 * Get heatmap data for a page
 */
async function getHeatmapData(pageUrl, Database) {
  const events = await Database.find('session_events', { 
    page_url: pageUrl,
    event_type: 'click'
  }, { limit: 10000 });
  
  const clicks = events.map(e => {
    const coords = e.coordinates ? JSON.parse(e.coordinates) : null;
    return coords ? { x: coords.x, y: coords.y, element: e.element_id } : null;
  }).filter(Boolean);
  
  const scrollDepths = events.map(e => e.scroll_position || 0);
  
  return {
    page_url: pageUrl,
    total_clicks: clicks.length,
    click_points: clicks,
    max_scroll: Math.max(...scrollDepths, 0),
    avg_scroll: scrollDepths.length > 0 ? Math.round(scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length) : 0,
    unique_elements_clicked: [...new Set(clicks.map(c => c.element))].length
  };
}

/**
 * List sessions (filterable)
 */
async function listSessions(filters, Database) {
  const { platform, user_email, is_active, has_error, has_rage_click, limit = 50, sort = '-started_at' } = filters;
  
  const query = {};
  if (platform) query.platform = platform;
  if (user_email) query.user_email = user_email;
  if (is_active !== undefined) query.is_active = is_active;
  if (has_error) query.has_error = true;
  if (has_rage_click) query.has_rage_click = true;
  
  const sessions = await Database.find('session_recordings', query, {
    limit: parseInt(limit), sort
  });
  
  return {
    count: sessions.length,
    sessions: sessions.map(s => ({
      id: s.id,
      user_email: s.user_email === 'anonymous' ? 'anonymous' : '***',
      platform: s.platform,
      device: s.device_type,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration: s.duration_seconds,
      pages: s.page_count,
      events: s.event_count,
      bounce: s.is_bounce,
      error: s.has_error,
      rage_click: s.has_rage_click,
      conversion: s.conversion
    }))
  };
}

/**
 * Get session statistics
 */
async function getSessionStats(Database) {
  const sessions = await Database.find('session_recordings', {}, { limit: 10000 });
  const active = sessions.filter(s => s.is_active);
  const bounced = sessions.filter(s => s.is_bounce);
  const errors = sessions.filter(s => s.has_error);
  const rage = sessions.filter(s => s.has_rage_click);
  const conversions = sessions.filter(s => s.conversion);
  
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const avgDuration = sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0;
  
  const byPlatform = {};
  sessions.forEach(s => {
    if (!byPlatform[s.platform]) byPlatform[s.platform] = { total: 0, active: 0, errors: 0, conversions: 0 };
    byPlatform[s.platform].total++;
    if (s.is_active) byPlatform[s.platform].active++;
    if (s.has_error) byPlatform[s.platform].errors++;
    if (s.conversion) byPlatform[s.platform].conversions++;
  });
  
  return {
    total_sessions: sessions.length,
    active_now: active.length,
    bounce_rate: sessions.length > 0 ? ((bounced.length / sessions.length) * 100).toFixed(1) + '%' : '—',
    avg_duration_seconds: avgDuration,
    error_sessions: errors.length,
    rage_click_sessions: rage.length,
    conversion_rate: sessions.length > 0 ? ((conversions.length / sessions.length) * 100).toFixed(1) + '%' : '—',
    by_platform: byPlatform
  };
}

module.exports = {
  startSession,
  recordSessionEvent,
  endSession,
  getSessionReplay,
  getHeatmapData,
  listSessions,
  getSessionStats
};
