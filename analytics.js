/**
 * HARZ Cloud — Analytics Engine
 * 
 * Tracks user behavior across all 23 HARZ platforms:
 * - Page views & navigation
 * - Custom events (clicks, purchases, signups)
 * - Conversion funnels
 * - Revenue analytics
 * - User retention & cohorts
 * - Platform-level metrics
 * - Real-time active users
 * - Traffic sources
 */

const crypto = require('crypto');

// Event types
const EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  CLICK: 'click',
  PURCHASE: 'purchase',
  SIGNUP: 'signup',
  LOGIN: 'login',
  LOGOUT: 'logout',
  SEARCH: 'search',
  ADD_TO_CART: 'add_to_cart',
  DOWNLOAD: 'download',
  SHARE: 'share',
  CUSTOM: 'custom'
};

/**
 * Track an analytics event
 */
async function trackEvent(params, Database) {
  const {
    event_type,
    user_email,
    user_id,
    platform,
    page_url,
    page_title,
    event_name,
    event_value,
    event_category,
    session_id,
    device_type,
    browser,
    country,
    referrer,
    duration_ms,
    metadata = {}
  } = params;
  
  const event = {
    id: crypto.randomUUID(),
    event_type,
    event_name: event_name || event_type,
    event_category: event_category || 'general',
    event_value: event_value || null,
    user_email: user_email || 'anonymous',
    user_id: user_id || null,
    platform: platform || 'unknown',
    page_url: page_url || '',
    page_title: page_title || '',
    session_id: session_id || null,
    device_type: device_type || 'unknown',
    browser: browser || 'unknown',
    country: country || 'unknown',
    referrer: referrer || 'direct',
    duration_ms: duration_ms || null,
    metadata: JSON.stringify(metadata),
    timestamp: new Date().toISOString(),
    created_date: new Date().toISOString()
  };
  
  await Database.insert('analytics_events', event);
  
  return { success: true, event_id: event.id, tracked: true };
}

/**
 * Track page view
 */
async function trackPageView(params, Database) {
  return trackEvent({
    ...params,
    event_type: EVENT_TYPES.PAGE_VIEW,
    event_category: 'navigation'
  }, Database);
}

/**
 * Track a purchase
 */
async function trackPurchase(params, Database) {
  const { user_email, platform, product_name, product_id, amount, currency, payment_method, session_id } = params;
  
  // Track the purchase event
  const eventResult = await trackEvent({
    event_type: EVENT_TYPES.PURCHASE,
    event_name: 'purchase',
    event_category: 'revenue',
    event_value: amount,
    user_email,
    platform,
    session_id,
    metadata: {
      product_name, product_id, amount, currency, payment_method
    }
  }, Database);
  
  // Also store in revenue tracking
  const revenue = {
    id: crypto.randomUUID(),
    user_email,
    platform,
    product_name,
    product_id,
    amount,
    currency: currency || 'NGN',
    payment_method: payment_method || 'unknown',
    session_id,
    created_date: new Date().toISOString()
  };
  
  await Database.insert('analytics_revenue', revenue);
  
  return { success: true, event_id: eventResult.event_id, revenue_id: revenue.id };
}

/**
 * Get analytics summary
 */
async function getAnalyticsSummary(timeRange, Database) {
  const now = new Date();
  let startDate = new Date();
  
  switch (timeRange) {
    case 'today': startDate.setHours(0, 0, 0, 0); break;
    case '7d': startDate.setDate(startDate.getDate() - 7); break;
    case '30d': startDate.setDate(startDate.getDate() - 30); break;
    case '90d': startDate.setDate(startDate.getDate() - 90); break;
    default: startDate.setDate(startDate.getDate() - 7);
  }
  
  const startISO = startDate.toISOString();
  
  // Get all events in range
  const events = await Database.find('analytics_events', {}, { limit: 10000, sort: '-created_date' });
  const filtered = events.filter(e => e.created_date >= startISO);
  
  // Page views
  const pageViews = filtered.filter(e => e.event_type === 'page_view');
  
  // Unique users
  const uniqueUsers = new Set(filtered.map(e => e.user_email)).size;
  
  // Purchases
  const purchases = filtered.filter(e => e.event_type === 'purchase');
  
  // Revenue
  const revenueRecords = await Database.find('analytics_revenue', {}, { limit: 10000 });
  const filteredRevenue = revenueRecords.filter(r => r.created_date >= startISO);
  const totalRevenue = filteredRevenue.reduce((sum, r) => {
    if (r.currency === 'NGN') return sum + r.amount;
    return sum;
  }, 0);
  
  // By platform
  const byPlatform = {};
  filtered.forEach(e => {
    if (!byPlatform[e.platform]) byPlatform[e.platform] = { views: 0, events: 0, purchases: 0 };
    byPlatform[e.platform].events++;
    if (e.event_type === 'page_view') byPlatform[e.platform].views++;
    if (e.event_type === 'purchase') byPlatform[e.platform].purchases++;
  });
  
  // By event type
  const byEventType = {};
  filtered.forEach(e => {
    byEventType[e.event_type] = (byEventType[e.event_type] || 0) + 1;
  });
  
  // Top pages
  const pageCounts = {};
  pageViews.forEach(e => {
    const key = e.page_url || e.page_title || 'unknown';
    pageCounts[key] = (pageCounts[key] || 0) + 1;
  });
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, views: count }));
  
  // Traffic sources
  const sources = {};
  filtered.forEach(e => {
    const ref = e.referrer || 'direct';
    sources[ref] = (sources[ref] || 0) + 1;
  });
  const topSources = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => ({ source, visits: count }));
  
  // Device breakdown
  const devices = {};
  filtered.forEach(e => {
    devices[e.device_type] = (devices[e.device_type] || 0) + 1;
  });
  
  return {
    time_range: timeRange,
    start_date: startISO,
    end_date: now.toISOString(),
    total_events: filtered.length,
    page_views: pageViews.length,
    unique_users: uniqueUsers,
    total_purchases: purchases.length,
    total_revenue_ngn: totalRevenue,
    by_platform: byPlatform,
    by_event_type: byEventType,
    top_pages: topPages,
    top_sources: topSources,
    device_breakdown: devices
  };
}

/**
 * Get real-time active users
 */
async function getActiveUsers(Database) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const events = await Database.find('analytics_events', {}, { limit: 10000, sort: '-created_date' });
  const active = events.filter(e => e.created_date >= fiveMinAgo);
  
  const activeUsers = new Set(active.map(e => e.user_email));
  const byPlatform = {};
  
  active.forEach(e => {
    if (!byPlatform[e.platform]) byPlatform[e.platform] = 0;
    byPlatform[e.platform]++;
  });
  
  return {
    active_users: activeUsers.size,
    active_sessions: new Set(active.map(e => e.session_id).filter(Boolean)).size,
    events_last_5min: active.length,
    by_platform: byPlatform,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get conversion funnel
 */
async function getFunnel(steps, Database) {
  const events = await Database.find('analytics_events', {}, { limit: 50000 });
  
  const funnel = [];
  let prevUsers = null;
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const matching = events.filter(e => 
      e.event_type === step.event_type && 
      (!step.event_name || e.event_name === step.event_name)
    );
    
    const users = new Set(matching.map(e => e.user_email));
    
    funnel.push({
      step: i + 1,
      name: step.name || step.event_type,
      users: users.size,
      events: matching.length,
      conversion_rate: prevUsers ? ((users.size / prevUsers) * 100).toFixed(1) + '%' : '100%',
      drop_off: prevUsers ? (((prevUsers - users.size) / prevUsers) * 100).toFixed(1) + '%' : '—'
    });
    
    prevUsers = users.size;
  }
  
  return { funnel, overall_conversion: funnel.length > 1 ? funnel[funnel.length - 1].conversion_rate : '—' };
}

/**
 * Get user journey
 */
async function getUserJourney(userEmail, Database) {
  const events = await Database.find('analytics_events', { user_email: userEmail }, {
    limit: 100, sort: 'created_date'
  });
  
  return {
    user_email: userEmail,
    total_events: events.length,
    first_seen: events[0]?.created_date,
    last_seen: events[events.length - 1]?.created_date,
    journey: events.map(e => ({
      timestamp: e.created_date,
      type: e.event_type,
      name: e.event_name,
      platform: e.platform,
      page: e.page_title || e.page_url
    }))
  };
}

module.exports = {
  EVENT_TYPES,
  trackEvent,
  trackPageView,
  trackPurchase,
  getAnalyticsSummary,
  getActiveUsers,
  getFunnel,
  getUserJourney
};
