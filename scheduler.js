/**
 * HARZ Cloud — Internal Scheduler
 * Runs periodic tasks without external cron
 */
const crypto = require('crypto');

const jobs = new Map();

const SCHEDULED_TASKS = {
  daily_backup: { interval: 86400000, script: 'backup.js', description: 'Daily database backup' },
  revenue_report: { interval: 86400000, hour: 21, description: 'Daily revenue report at 9PM' },
  crm_followup: { interval: 86400000, hour: 8, description: 'CRM follow-up check at 8AM' },
  platform_health: { interval: 21600000, description: 'Platform health check every 6hrs' },
  product_upload: { interval: 86400000, hour: 5, description: 'Daily product upload at 5AM' },
  session_cleanup: { interval: 3600000, description: 'Clean expired sessions hourly' },
  memory_consolidate: { interval: 604800000, description: 'Weekly memory consolidation' },
  bandwidth_reset: { interval: 86400000, hour: 0, description: 'Reset daily bandwidth counters' }
};

function start(name, callback, interval) {
  if (jobs.has(name)) {
    clearInterval(jobs.get(name));
  }
  
  const jobId = setInterval(callback, interval || SCHEDULED_TASKS[name]?.interval || 3600000);
  jobs.set(name, jobId);
  
  return { started: true, name, interval: interval || SCHEDULED_TASKS[name]?.interval };
}

function stop(name) {
  if (jobs.has(name)) {
    clearInterval(jobs.get(name));
    jobs.delete(name);
    return { stopped: true, name };
  }
  return { stopped: false, name, error: 'Job not found' };
}

function list() {
  return Array.from(jobs.keys()).map(name => ({
    name,
    running: true,
    config: SCHEDULED_TASKS[name] || { interval: 'custom' }
  }));
}

function stopAll() {
  for (const [name, id] of jobs) {
    clearInterval(id);
  }
  jobs.clear();
  return { stopped_all: true, count: 0 };
}

module.exports = { start, stop, list, stopAll, SCHEDULED_TASKS };
